import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type {
  CompanyData,
  CompanyFile,
  CompanyFolder,
  CompanyUpdateRequest,
  FileUploadResponse,
  FileListResponse,
} from "@/lib/types/company"

export class CompanyService {
  // Company Data Operations
  static async getCompanyData(companyId: string): Promise<CompanyData | null> {
    try {
      const companyDoc = await getDoc(doc(db, "companies", companyId))
      if (companyDoc.exists()) {
        const data = companyDoc.data()
        return {
          companyId,
          name: data.name || "",
          address: data.address || {},
          tin: data.tin || "",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
          company_profile: data.company_profile || "",
          logo: data.logo || "",
          business_type: data.business_type || "",
          position: data.position || "",
          createdAt: data.created_at?.toDate() || new Date(),
          updatedAt: data.updated_at?.toDate() || new Date(),
          createdBy: data.created_by || "",
          updatedBy: data.updated_by || "",
        }
      }
      return null
    } catch (error) {
      console.error("Error fetching company data:", error)
      throw error
    }
  }

  // Check if company information is complete
  static async isCompanyInfoComplete(companyId: string): Promise<boolean> {
    try {
      const companyData = await CompanyService.getCompanyData(companyId)
      if (!companyData) {
        return false
      }

      // Only require company name for basic completeness
      // This allows users to upload products once they have a company name
      const hasCompanyName = Boolean(companyData.name?.trim() && companyData.name.trim().length > 0)

      return hasCompanyName
    } catch (error) {
      console.error("Error checking company info completeness:", error)
      return false
    }
  }

  static async updateCompanyData(
    companyId: string,
    userId: string,
    updates: CompanyUpdateRequest
  ): Promise<void> {
    try {
      const companyRef = doc(db, "companies", companyId)
      await updateDoc(companyRef, {
        ...updates,
        updated_at: serverTimestamp(),
        updated_by: userId,
      })
    } catch (error) {
      console.error("Error updating company data:", error)
      throw error
    }
  }

  static async createCompanyData(
    companyId: string,
    userId: string,
    companyData: Omit<CompanyData, "companyId" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">
  ): Promise<void> {
    try {
      const companyRef = doc(db, "companies", companyId)
      await setDoc(companyRef, {
        ...companyData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: userId,
        updated_by: userId,
      })
    } catch (error) {
      console.error("Error creating company data:", error)
      throw error
    }
  }

  // File Storage Operations
  static async uploadFile(
    file: File,
    companyId: string,
    userId: string,
    folder: string = ""
  ): Promise<FileUploadResponse> {
    try {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const filePath = `companies/${companyId}/${folder ? folder + "/" : ""}${fileId}-${file.name}`
      const storageRef = ref(storage, filePath)

      // Upload file to Firebase Storage
      await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(storageRef)

      // Save file metadata to Firestore
      const fileData: Omit<CompanyFile, "id"> = {
        name: file.name,
        size: file.size,
        type: file.type,
        url: downloadURL,
        path: filePath,
        uploadedBy: userId,
        uploadedAt: new Date(),
        companyId,
        userId,
        folder: folder || "",
        deleted: false, // Mark as not deleted by default
      }

      await setDoc(doc(db, "company_files", fileId), fileData)

      return {
        success: true,
        file: { id: fileId, ...fileData },
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      }
    }
  }

  static async getCompanyFiles(companyId: string, folder: string = ""): Promise<FileListResponse> {
    try {
      console.log("CompanyService.getCompanyFiles - companyId:", companyId, "folder:", folder)

      // Query files (exclude deleted files)
      const filesQuery = query(
        collection(db, "company_files"),
        where("companyId", "==", companyId),
        where("folder", "==", folder),
        where("deleted", "==", false), // Only get non-deleted files
        orderBy("uploadedAt", "desc")
      )

      const filesSnapshot = await getDocs(filesQuery)
      const files: CompanyFile[] = filesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
      })) as CompanyFile[]

      // Query folders (exclude deleted folders)
      const foldersQuery = query(
        collection(db, "company_folders"),
        where("companyId", "==", companyId),
        where("parentId", "==", folder || null),
        where("deleted", "==", false), // Only get non-deleted folders
        orderBy("createdAt", "desc")
      )

      const foldersSnapshot = await getDocs(foldersQuery)
      const folders: CompanyFolder[] = foldersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as CompanyFolder[]

      console.log("CompanyService.getCompanyFiles - found files:", files.length, "folders:", folders.length)

      return {
        success: true,
        files,
        folders,
      }
    } catch (error) {
      console.error("Error fetching company files:", error)
      return {
        success: false,
        files: [],
        folders: [],
        error: error instanceof Error ? error.message : "Failed to fetch files",
      }
    }
  }

  static async deleteFile(fileId: string, companyId: string, userId: string): Promise<boolean> {
    try {
      console.log("CompanyService.deleteFile - soft deleting file:", fileId)

      // Get file metadata
      const fileDoc = await getDoc(doc(db, "company_files", fileId))
      if (!fileDoc.exists()) {
        throw new Error("File not found")
      }

      const fileData = fileDoc.data()
      if (fileData.companyId !== companyId) {
        throw new Error("Unauthorized access to file")
      }

      // Soft delete: Mark as deleted instead of actually deleting
      await updateDoc(doc(db, "company_files", fileId), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
      })

      console.log("CompanyService.deleteFile - file marked as deleted:", fileId)
      return true
    } catch (error) {
      console.error("Error soft deleting file:", error)
      return false
    }
  }

  static async createFolder(
    companyId: string,
    userId: string,
    folderName: string,
    parentFolder: string = ""
  ): Promise<CompanyFolder | null> {
    try {
      console.log("CompanyService.createFolder - companyId:", companyId, "userId:", userId)
      console.log("CompanyService.createFolder - folderName:", folderName, "parentFolder:", parentFolder)

      const folderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const folderPath = parentFolder ? `${parentFolder}/${folderName}` : folderName

      const folderData: Omit<CompanyFolder, "id"> = {
        name: folderName,
        path: folderPath,
        parentId: parentFolder || null,
        createdBy: userId,
        createdAt: new Date(),
        companyId,
        userId,
        deleted: false, // Mark as not deleted by default
      }

      console.log("CompanyService.createFolder - saving folder data:", folderData)

      await setDoc(doc(db, "company_folders", folderId), folderData)

      console.log("CompanyService.createFolder - folder created with ID:", folderId)

      return { id: folderId, ...folderData }
    } catch (error) {
      console.error("Error creating folder:", error)
      return null
    }
  }

  static async getCompanyFolders(companyId: string, parentFolder: string = ""): Promise<CompanyFolder[]> {
    try {
      const foldersQuery = query(
        collection(db, "company_folders"),
        where("companyId", "==", companyId),
        where("parentId", "==", parentFolder || null),
        where("deleted", "==", false), // Only get non-deleted folders
        orderBy("createdAt", "desc")
      )

      const foldersSnapshot = await getDocs(foldersQuery)
      return foldersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as CompanyFolder[]
    } catch (error) {
      console.error("Error fetching company folders:", error)
      return []
    }
  }

  static async deleteFolder(folderId: string, companyId: string, userId: string): Promise<boolean> {
    try {
      console.log("CompanyService.deleteFolder - soft deleting folder:", folderId)

      // Get folder metadata
      const folderDoc = await getDoc(doc(db, "company_folders", folderId))
      if (!folderDoc.exists()) {
        throw new Error("Folder not found")
      }

      const folderData = folderDoc.data()
      if (folderData.companyId !== companyId) {
        throw new Error("Unauthorized access to folder")
      }

      // Soft delete: Mark as deleted instead of actually deleting
      await updateDoc(doc(db, "company_folders", folderId), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
      })

      console.log("CompanyService.deleteFolder - folder marked as deleted:", folderId)
      return true
    } catch (error) {
      console.error("Error soft deleting folder:", error)
      return false
    }
  }
}
