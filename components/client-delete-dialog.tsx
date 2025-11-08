"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteClient } from "@/lib/client-service"
import { toast } from "@/components/ui/use-toast"

interface ClientDeleteDialogProps {
  clientId: string | null
  clientName: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function ClientDeleteDialog({ clientId, clientName, isOpen, onOpenChange, onDeleted }: ClientDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!clientId) return

    setIsDeleting(true)
    try {
      await deleteClient(clientId)
      toast({
        title: "Client deleted",
        description: "The client has been deleted successfully.",
      })
      onOpenChange(false)
      if (onDeleted) onDeleted()
    } catch (error) {
      console.error("Error deleting client:", error)
      toast({
        title: "Error",
        description: "There was an error deleting the client. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the client <strong>{clientName}</strong> and all associated data. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
