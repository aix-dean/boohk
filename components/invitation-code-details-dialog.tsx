"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Calendar, Users, Shield, Clock, Activity, CheckCircle, XCircle, Ban } from "lucide-react"
import { toast } from "sonner"
import type { Timestamp } from "firebase/firestore"

interface InvitationCodeDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: {
    id: string
    code: string
    createdAt: Timestamp
    expiresAt: Timestamp
    usageLimit: number
    usageCount: number
    role: string
    permissions: string[]
    status: "active" | "inactive" | "expired"
    createdBy: string
    companyId: string
    usedBy?: string[]
    description?: string
  }
}

export function InvitationCodeDetailsDialog({ open, onOpenChange, code }: InvitationCodeDetailsDialogProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "inactive":
        return <Ban className="h-4 w-4 text-gray-500" />
      case "expired":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      expired: "destructive",
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const registrationUrl = `${window.location.origin}/register?code=${code.code}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invitation Code Details</DialogTitle>
          <DialogDescription>Complete information about this invitation code</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Code Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>Code Information</span>
                {getStatusIcon(code.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Code</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-muted px-3 py-2 rounded text-lg font-mono">{code.code}</code>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(code.code)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(code.status)}
                    {getStatusBadge(code.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(code.createdAt)}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expires</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(code.expiresAt)}</span>
                  </div>
                </div>
              </div>

              {code.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{code.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Usage Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Usage Count</label>
                  <div className="text-2xl font-bold mt-1">{code.usageCount}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Usage Limit</label>
                  <div className="text-2xl font-bold mt-1">
                    {code.usageLimit === 0 ? <Badge variant="secondary">Unlimited</Badge> : code.usageLimit}
                  </div>
                </div>
              </div>

              {code.usageLimit > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Usage Progress</label>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{code.usageCount} used</span>
                      <span>{code.usageLimit - code.usageCount} remaining</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min((code.usageCount / code.usageLimit) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role and Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Role & Permissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Assigned Role</label>
                <div className="mt-1">
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {code.role}
                  </Badge>
                </div>
              </div>

              {code.permissions.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Permissions</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {code.permissions.map((permission) => (
                      <Badge key={permission} variant="secondary" className="text-xs">
                        {permission.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registration Link */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registration Link</CardTitle>
              <CardDescription>Share this link for easy registration with this code</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">{registrationUrl}</div>
                <Button variant="outline" onClick={() => copyToClipboard(registrationUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage History */}
          {code.usedBy && code.usedBy.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Usage History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {code.usedBy.map((userId, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{userId}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
