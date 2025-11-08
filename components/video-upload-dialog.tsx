"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, X, FileVideo } from "lucide-react"
import { toast } from "sonner"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface VideoUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadSuccess: () => void
  productId?: string
  spotNumber?: number | null
  companyId?: string
  sellerId?: string
}

export default function VideoUploadDialog({
  open,
  onOpenChange,
  onUploadSuccess,
  productId,
  spotNumber,
  companyId,
  sellerId,
}: VideoUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    duration: "",
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("video/")) {
        toast.error("Please select a valid video file")
        return
      }

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024 // 50MB in bytes
      if (file.size > maxSize) {
        toast.error("File size must be less than 50MB")
        return
      }

      setSelectedFile(file)
      setFormData((prev) => ({
        ...prev,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      }))
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const calculateSpotTimes = (spotNumber: number) => {
    // Assuming each spot is 15 seconds and starts from a base time
    // You may need to adjust this based on your actual CMS configuration
    const spotDuration = 15 // seconds
    const baseStartSeconds = (spotNumber - 1) * spotDuration

    const startHours = Math.floor(baseStartSeconds / 3600)
    const startMinutes = Math.floor((baseStartSeconds % 3600) / 60)
    const startSeconds = baseStartSeconds % 60

    const endTotalSeconds = baseStartSeconds + spotDuration
    const endHours = Math.floor(endTotalSeconds / 3600)
    const endMinutes = Math.floor((endTotalSeconds % 3600) / 60)
    const endSecondsRemainder = endTotalSeconds % 60

    const formatTime = (hours: number, minutes: number, seconds: number) => {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }

    return {
      startTime: formatTime(startHours, startMinutes, startSeconds),
      endTime: formatTime(endHours, endMinutes, endSecondsRemainder),
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !productId || !spotNumber) {
      toast.error("Missing required information")
      return
    }

    if (!formData.title.trim()) {
      toast.error("Please enter a title for the video")
      return
    }

    setUploading(true)

    try {
      // Upload file to Firebase Storage
      const downloadURL = await uploadFileToFirebaseStorage(selectedFile, `videos/${productId}/`)

      // Calculate spot times
      const { startTime, endTime } = calculateSpotTimes(spotNumber)

      // Create schedule data
      const currentDate = new Date()
      const nextYear = new Date()
      nextYear.setFullYear(currentDate.getFullYear() + 1)

      const scheduleData = {
        startDate: currentDate.toISOString().split("T")[0], // Format: YYYY-MM-DD
        endDate: nextYear.toISOString().split("T")[0], // Format: YYYY-MM-DD
        plans: [
          {
            weekDays: [0, 1, 2, 3, 4, 5, 6], // All days of the week (Sunday = 0, Monday = 1, etc.)
            startTime: startTime, // Format: HH:MM:SS
            endTime: endTime, // Format: HH:MM:SS
          },
        ],
      }

      // Save to screen_schedule collection
      const screenScheduleData = {
        product_id: productId,
        spot_number: spotNumber,
        title: formData.title.trim(),
        description: formData.description.trim(),
        duration: formData.duration ? Number.parseInt(formData.duration) : null,
        media: downloadURL,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        company_id: companyId || null,
        seller_id: sellerId || null,
        active: true,
        deleted: false,
        schedule: scheduleData, // Add the schedule field
        created: serverTimestamp(),
        updated: serverTimestamp(),
      }

      await addDoc(collection(db, "screen_schedule"), screenScheduleData)

      toast.success("Video uploaded successfully!")

      // Reset form
      setSelectedFile(null)
      setFormData({
        title: "",
        description: "",
        duration: "",
      })

      onUploadSuccess()
    } catch (error) {
      console.error("Error uploading video:", error)
      toast.error("Failed to upload video. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFormData((prev) => ({
      ...prev,
      title: "",
    }))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Video for Spot {spotNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Video File</Label>
            {!selectedFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" id="video-upload" />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">MP4, MOV, AVI up to 50MB</p>
                </label>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileVideo className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Video Details Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter video title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter video description (optional)"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => handleInputChange("duration", e.target.value)}
                placeholder="e.g., 30"
                min="1"
              />
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || !formData.title.trim() || uploading}>
              {uploading ? "Uploading..." : "Upload Video"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
