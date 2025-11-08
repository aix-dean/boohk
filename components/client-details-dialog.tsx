"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ClientForm } from "@/components/client-form"
import type { Client } from "@/lib/client-service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { Edit, User, Building, Phone, Mail, MapPin, Briefcase, FileText } from "lucide-react"

interface ClientDetailsDialogProps {
  client: Client | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onClientUpdated?: () => void
}

export function ClientDetailsDialog({ client, isOpen, onOpenChange, onClientUpdated }: ClientDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false)

  if (!client) return null

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "N/A"

    if (timestamp.toDate) {
      return formatDistanceToNow(timestamp.toDate(), { addSuffix: true })
    }

    return "N/A"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>{client.name}</span>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>{isEditing ? "Edit client information" : "View client details"}</DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <ClientForm
            client={client}
            onSuccess={() => {
              setIsEditing(false)
              if (onClientUpdated) onClientUpdated()
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-2">
                  <User className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Name</p>
                    <p className="text-sm text-gray-500">{client.name}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Building className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Company</p>
                    <p className="text-sm text-gray-500">{client.company}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Mail className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-gray-500">{client.email}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Phone className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-sm text-gray-500">{client.phone}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-sm text-gray-500">
                      {client.address}
                      {client.address && (client.city || client.state || client.zipCode) && ", "}
                      {client.city}
                      {client.city && (client.state || client.zipCode) && ", "}
                      {client.state} {client.zipCode}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Briefcase className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Industry</p>
                    <p className="text-sm text-gray-500">{client.industry || "Not specified"}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">Created: {formatTimestamp(client.created)}</p>
                <p className="text-sm text-gray-500">Last updated: {formatTimestamp(client.updated)}</p>
              </div>
            </TabsContent>
            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="flex items-start space-x-2">
                <FileText className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium">Notes</p>
                  <p className="text-sm text-gray-500 whitespace-pre-line">{client.notes || "No notes available."}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
