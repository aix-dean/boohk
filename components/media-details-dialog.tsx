"use client"

import Image from "next/image"
import { Media } from "oh-db-models"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Download, Calendar, FileType, HardDrive } from "lucide-react"

interface MediaDetailsDialogProps {
  media: Media | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaDetailsDialog({ media, open, onOpenChange }: MediaDetailsDialogProps) {
  if (!media) return null

  const isVideo = media.type.startsWith("video/")
  const uploadDate = media.uploadDate ? new Date(media.uploadDate.toDate()) : null

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = media.url
    link.download = media.title || media.name || 'media'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">
            {media.title || media.name || "Media Details"}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Media Display */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            {isVideo ? (
              <video
                src={media.url}
                controls
                className="w-full max-h-[60vh] object-contain"
              />
            ) : (
              <div className="relative w-full max-h-[60vh]">
                <Image
                  src={media.url}
                  alt={media.title || media.name || "Media"}
                  fill
                  className="object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/abstract-geometric-sculpture.png"
                    target.className = "opacity-50 object-contain"
                  }}
                />
              </div>
            )}
          </div>

          {/* Media Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <FileType className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Type:</span>
                <span className="text-sm text-gray-600">{media.type}</span>
              </div>

              {media.size && (
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Size:</span>
                  <span className="text-sm text-gray-600">
                    {(media.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              )}

              {uploadDate && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Uploaded:</span>
                  <span className="text-sm text-gray-600">
                    {uploadDate.toLocaleDateString()} at {uploadDate.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleDownload} variant="outline" className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Download</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}