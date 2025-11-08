import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"

/**
 * Converts a PNG data URL to a File object
 */
function dataURLToFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

/**
 * Uploads a signature PNG data URL to Firebase Storage
 * @param dataURL - The PNG data URL to upload
 * @param userId - The user ID to organize files under
 * @returns Promise<string> - The download URL of the uploaded file
 */
export const uploadSignature = async (dataURL: string, userId: string): Promise<string> => {
  try {
    // Convert data URL to File object
    const filename = `${Date.now()}.png`
    const file = dataURLToFile(dataURL, filename)

    // Create storage reference
    const storageRef = ref(storage, `signatures/${userId}/${filename}`)

    // Upload the file
    await uploadBytes(storageRef, file)

    // Get and return the download URL
    const downloadURL = await getDownloadURL(storageRef)
    return downloadURL
  } catch (error) {
    console.error("Error uploading signature:", error)
    throw new Error("Failed to upload signature")
  }
}