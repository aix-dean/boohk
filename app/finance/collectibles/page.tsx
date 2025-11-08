"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, Eye, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { collection, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"

interface Collectible {
  id: string
  created: string
  company_id: string
  type: "sites" | "supplies"
  updated: string
  deleted: boolean
  client_name: string
  net_amount: number
  total_amount: number
  mode_of_payment: string
  bank_name: string
  bi_no: string
  or_no: string
  invoice_no: string
  next_collection_date: string
  status: "pending" | "collected" | "overdue" | "paid"
  // Sites specific fields
  booking_no?: string
  site?: string
  covered_period?: string
  bir_2307?: string
  collection_date?: string
  // Supplies specific fields
  date?: string
  product?: string
  transfer_date?: string
  bs_no?: string
  due_for_collection?: string
  date_paid?: string
  net_amount_collection?: number
}

export default function CollectiblesPage() {
  const [collectibles, setCollectibles] = useState<Collectible[]>([])
  const [filteredCollectibles, setFilteredCollectibles] = useState<Collectible[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    const fetchCollectibles = async () => {
      if (!user?.company_id && !user?.uid) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const collectiblesRef = collection(db, "collectibles")

        // Query collectibles for the current user's company
        const q = query(
          collectiblesRef,
          where("company_id", "==", user.company_id || user.uid),
          where("deleted", "==", false), // Only fetch non-deleted records
          orderBy("created", "desc"),
        )

        const querySnapshot = await getDocs(q)
        const fetchedCollectibles: Collectible[] = []

        querySnapshot.forEach((doc) => {
          fetchedCollectibles.push({ id: doc.id, ...doc.data() } as Collectible)
        })

        setCollectibles(fetchedCollectibles)
      } catch (error) {
        console.error("Error fetching collectibles:", error)
        setCollectibles([])
      } finally {
        setLoading(false)
      }
    }

    fetchCollectibles()
  }, [user])

  // Filter collectibles (soft delete - only show deleted: false)
  useEffect(() => {
    let filtered = collectibles.filter((item) => !item.deleted)

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.or_no.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter)
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.type === typeFilter)
    }

    setFilteredCollectibles(filtered)
  }, [collectibles, searchTerm, statusFilter, typeFilter])

  const handleSoftDelete = async (id: string) => {
    try {
      const collectibleRef = doc(db, "collectibles", id)
      await updateDoc(collectibleRef, {
        deleted: true,
        updated: serverTimestamp(),
      })

      // Update local state
      setCollectibles((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, deleted: true, updated: new Date().toISOString().split("T")[0] } : item,
        ),
      )
    } catch (error) {
      console.error("Error soft deleting collectible:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      collected: "default",
      overdue: "destructive",
      paid: "default",
    } as const

    if (status === "paid") {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{status}</Badge>
    }

    return <Badge variant={variants[status as keyof typeof variants] || "secondary"}>{status}</Badge>
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const displayValue = (value: string | number | undefined | null): string => {
    if (value === null || value === undefined || value === "" || (typeof value === "string" && value.trim() === "")) {
      return "-"
    }
    return String(value)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Collectibles</h1>
            <p className="text-muted-foreground">Manage your collection records and track payments</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading collectibles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Collectibles</h1>
          <p className="text-muted-foreground">Manage your collection records and track payments</p>
        </div>
        <Link href="/finance/collectibles/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Collectible
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client name, invoice no, or OR no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="collected">Collected</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sites">Sites</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collectibles Records</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCollectibles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No collectibles found</p>
              <Link href="/finance/collectibles/create">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Collectible
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>OR No</TableHead>
                    <TableHead>BI No</TableHead>
                    <TableHead>Net Amount</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Collection</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollectibles.map((collectible) => (
                    <TableRow key={collectible.id}>
                      <TableCell className="font-medium">{displayValue(collectible.client_name)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{collectible.type}</Badge>
                      </TableCell>
                      <TableCell>{displayValue(collectible.invoice_no)}</TableCell>
                      <TableCell>{displayValue(collectible.or_no)}</TableCell>
                      <TableCell>{displayValue(collectible.bi_no)}</TableCell>
                      <TableCell>{collectible.net_amount ? formatCurrency(collectible.net_amount) : "-"}</TableCell>
                      <TableCell>{collectible.total_amount ? formatCurrency(collectible.total_amount) : "-"}</TableCell>
                      <TableCell>{displayValue(collectible.mode_of_payment)}</TableCell>
                      <TableCell>{displayValue(collectible.bank_name)}</TableCell>
                      <TableCell className="whitespace-nowrap min-w-[100px]">
                        {getStatusBadge(collectible.status)}
                      </TableCell>
                      <TableCell>{displayValue(collectible.next_collection_date)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/finance/collectibles/details/${collectible.id}`}
                                className="flex items-center"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/finance/collectibles/edit/${collectible.id}`} className="flex items-center">
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSoftDelete(collectible.id)}
                              className="flex items-center text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
