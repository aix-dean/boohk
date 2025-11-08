"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, Eye, Mail, Ban, Calendar, Shield } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { GenerateInvitationCodeDialog } from "@/components/generate-invitation-code-dialog"
import { InvitationCodeDetailsDialog } from "@/components/invitation-code-details-dialog"
import { SendInvitationEmailDialog } from "@/components/send-invitation-email-dialog"
import { toast } from "sonner"

interface InvitationCode {
  id: string
  code: string
  created_at: any
  expires_at: any
  max_usage: number
  usage_count: number
  role: string
  permissions: string[]
  status: "active" | "inactive" | "expired"
  created_by: string
  company_id: string
  description?: string
  used_by: string[]
}

export default function InvitationCodesPage() {
  const { userData } = useAuth()
  const [codes, setCodes] = useState<InvitationCode[]>([])
  const [loading, setLoading] = useState(true)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<InvitationCode | null>(null)

  console.log("InvitationCodesPage - userData:", userData)

  useEffect(() => {
    if (!userData?.company_id) {
      console.log("No company_id found in userData")
      setLoading(false)
      return
    }

    console.log("Setting up Firestore listener for company:", userData.company_id)

    const q = query(
      collection(db, "invitation_codes"),
      where("company_id", "==", userData.company_id),
      orderBy("created_at", "desc"),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Firestore snapshot received, docs count:", snapshot.docs.length)
        const codesData = snapshot.docs.map((doc) => {
          const data = doc.data()
          console.log("Document data:", data)
          return {
            id: doc.id,
            ...data,
          } as InvitationCode
        })
        setCodes(codesData)
        setLoading(false)
      },
      (error) => {
        console.error("Error fetching invitation codes:", error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [userData?.company_id])

  const formatDate = (timestamp: any) => {
    try {
      if (!timestamp) return "N/A"

      let date: Date
      if (timestamp.toDate) {
        date = timestamp.toDate()
      } else if (timestamp instanceof Date) {
        date = timestamp
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp)
      } else {
        return "Invalid Date"
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid Date"
    }
  }

  const getStatusBadge = (code: InvitationCode) => {
    const now = new Date()
    let expiresAt: Date

    try {
      if (code.expires_at?.toDate) {
        expiresAt = code.expires_at.toDate()
      } else if (code.expires_at instanceof Date) {
        expiresAt = code.expires_at
      } else {
        expiresAt = new Date(code.expires_at)
      }

      if (code.status === "inactive") {
        return <Badge variant="secondary">Inactive</Badge>
      }

      if (now > expiresAt) {
        return <Badge variant="destructive">Expired</Badge>
      }

      if (code.max_usage > 0 && code.usage_count >= code.max_usage) {
        return <Badge variant="secondary">Used Up</Badge>
      }

      return <Badge variant="default">Active</Badge>
    } catch (error) {
      return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const handleDeactivate = async (codeId: string) => {
    try {
      await updateDoc(doc(db, "invitation_codes", codeId), {
        status: "inactive",
      })
      toast.success("Invitation code deactivated")
    } catch (error) {
      console.error("Error deactivating code:", error)
      toast.error("Failed to deactivate code")
    }
  }

  const handleViewDetails = (code: InvitationCode) => {
    setSelectedCode(code)
    setDetailsDialogOpen(true)
  }

  const handleSendEmail = (code: InvitationCode) => {
    setSelectedCode(code)
    setEmailDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading invitation codes...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!userData?.company_id) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">No Company Associated</h2>
          <p className="text-muted-foreground">You need to be associated with a company to manage invitation codes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invitation Codes</h1>
          <p className="text-muted-foreground">Manage invitation codes for user registration</p>
        </div>
        <Button onClick={() => setGenerateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generate Code
        </Button>
      </div>

      {/* Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invitation Codes</CardTitle>
          <CardDescription>View and manage all generated invitation codes</CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <Plus className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No invitation codes yet</h3>
              <p className="text-muted-foreground">Generate your first invitation code to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="font-mono text-sm bg-muted px-2 py-1 rounded">{code.code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{code.role}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {code.usage_count} / {code.max_usage === 0 ? "∞" : code.max_usage}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(code.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(code.expires_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(code)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendEmail(code)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          {code.status === "active" && (
                            <DropdownMenuItem onClick={() => handleDeactivate(code.id)}>
                              <Ban className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <GenerateInvitationCodeDialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen} />

      {selectedCode && (
        <>
          <InvitationCodeDetailsDialog
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            code={selectedCode}
          />
          <SendInvitationEmailDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} code={selectedCode} />
        </>
      )}
    </div>
  )
}
