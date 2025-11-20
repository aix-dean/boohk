"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Upload, Loader2, X } from "lucide-react"
import { createMediaLibrary, uploadMediaFile } from "@/lib/firebase-service"
import { Media } from "oh-db-models"

interface MediaUploadDialogProps {
  children: React.ReactNode
  onSuccess?: () => void
}

export function MediaUploadDialog({ children, onSuccess }: MediaUploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const { userData } = useAuth()
  const { toast } = useToast()

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/mov", "video/avi", "video/webm"]
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select an image or video file.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (100MB for videos, 10MB for images)
    const maxSize = selectedFile.type.startsWith("video/") ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${maxSize / (1024 * 1024)}MB.`,
        variant: "destructive",
      })
      return
    }

    setFile(selectedFile)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the media.",
        variant: "destructive",
      })
      return
    }

    if (!file) {
      toast({
        title: "File required",
        description: "Please select a file to upload.",
        variant: "destructive",
      })
      return
    }

    if (!userData?.company_id) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload media.",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    try {
      // Upload file to storage
      const downloadURL = await uploadMediaFile(file, userData.company_id)

      // Get video duration if it's a video
      let duration: number | undefined
      if (file.type.startsWith("video/")) {
        duration = await new Promise<number>((resolve, reject) => {
          const video = document.createElement('video')
          video.preload = 'metadata'

          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src)
            resolve(video.duration)
          }

          video.onerror = () => {
            window.URL.revokeObjectURL(video.src)
            reject(new Error('Failed to load video metadata'))
          }

          video.src = window.URL.createObjectURL(file)
        })
      }

      // Create media library record
      const mediaData = {
        name: file.name,
        title: title.trim(),
        type: file.type,
        size: file.size,
        companyId: userData.company_id,
        url: downloadURL,
        uploadedBy: userData.uid,
        ...(duration !== undefined && { duration }),
      }

      await createMediaLibrary(mediaData)

      toast({
        title: "Upload successful",
        description: "Media has been uploaded successfully.",
      })

      // Reset form
      setTitle("")
      setFile(null)
      setOpen(false)

      // Call success callback
      onSuccess?.()
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload failed",
        description: "Failed to upload media. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="relative">
          <DialogTitle>Upload</DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute -top-2 right-0 h-6 w-6 p-0"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter media title"
              disabled={uploading}
            />
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Media File</Label>
            {!file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop a file here, or click to select
                </p>
                <p className="text-xs text-gray-500">
                  Supports images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, AVI, WebM)
                </p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const files = e.target.files
                    if (files && files.length > 0) {
                      handleFileSelect(files[0])
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={uploading}
                >
                  Select File
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* File Preview */}
                <div className="flex justify-center">
                  {file.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      className="max-h-32 max-w-full rounded-lg object-contain"
                      onLoad={() => URL.revokeObjectURL(URL.createObjectURL(file))}
                    />
                  ) : file.type.startsWith("video/") ? (
                    <video
                      src={URL.createObjectURL(file)}
                      controls
                      className="max-h-32 max-w-full rounded-lg"
                      onLoad={() => URL.revokeObjectURL(URL.createObjectURL(file))}
                    />
                  ) : null}
                </div>

                {/* File Info */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading || !title.trim() || !file}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}