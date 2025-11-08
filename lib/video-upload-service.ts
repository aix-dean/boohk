import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { storage, db } from "@/lib/firebase"

export interface UploadProgress {
  progress: number
  status: "uploading" | "success" | "error"
  error?: string
  downloadURL?: string
}

export const uploadVideoToFirebase = async (
  file: File,
  productId: string,
  spotNumber: number,
  companyId: string,
  sellerId: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Validate file
    const allowedTypes = ["video/mp4", "video/mov", "video/avi", "video/webm"]
    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Invalid file type. Please select a video file."))
      return
    }

    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      reject(new Error("File size too large. Maximum size is 100MB."))
      return
    }

    // Create unique filename
    const timestamp = Date.now()
    const fileName = `videos/${productId}/spot_${spotNumber}_${timestamp}_${file.name}`
    const storageRef = ref(storage, fileName)

    // Start upload
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.({
          progress,
          status: "uploading",
        })
      },
      (error) => {
        console.error("Upload error:", error)
        onProgress?.({
          progress: 0,
          status: "error",
          error: error.message,
        })
        reject(error)
      },
      async () => {
        try {
          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

          // Create screen schedule document
          await addDoc(collection(db, "screen_schedule"), {
            active: true,
            product_id: productId,
            spot_number: spotNumber,
            created: serverTimestamp(),
            deleted: false,
            company_id: companyId,
            seller_id: sellerId,
            id: `${productId}_spot_${spotNumber}_${timestamp}`,
            status: "active",
            media: downloadURL,
            title: file.name,
          })

          onProgress?.({
            progress: 100,
            status: "success",
            downloadURL,
          })

          resolve(downloadURL)
        } catch (error) {
          console.error("Error creating schedule document:", error)
          onProgress?.({
            progress: 0,
            status: "error",
            error: "Failed to save video schedule",
          })
          reject(error)
        }
      },
    )
  })
}

export const validateVideoFile = (file: File): { valid: boolean; error?: string } => {
  const allowedTypes = ["video/mp4", "video/mov", "video/avi", "video/webm"]
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please select a video file (MP4, MOV, AVI, WebM).",
    }
  }

  const maxSize = 100 * 1024 * 1024 // 100MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File size too large. Maximum size is 100MB.",
    }
  }

  return { valid: true }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
