"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { db } from "@/lib/firebase"
import { collection, query, where, orderBy, getDocs } from "firebase/firestore"
import {
  Folder,
  File,
  Upload,
  Download,
  Trash2,
  Plus,
  ArrowLeft,
  Search,
  MoreVertical,
  FileText,
  Image,
  Video,
  Archive,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileUpload } from "@/components/file-upload"
import { CompanyService } from "@/lib/company-service"
import type { CompanyFile, CompanyFolder } from "@/lib/types/company"
import { cn } from "@/lib/utils"

interface FileBrowserProps {
  companyId: string
  userId: string
}

export function FileBrowser({ companyId, userId }: FileBrowserProps) {
  const [currentFolder, setCurrentFolder] = useState("")
  const [files, setFiles] = useState<CompanyFile[]>([])
  const [folders, setFolders] = useState<CompanyFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [isSpecialFolder, setIsSpecialFolder] = useState(false)
  const [specialFolderType, setSpecialFolderType] = useState<string | null>(null)
  const [projectDocuments, setProjectDocuments] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(8) // Items per page
  const [totalItems, setTotalItems] = useState(0)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasNextPage, setHasNextPage] = useState(false)

  const createDefaultFolders = useCallback(async () => {
    const defaultFolders = ['Reservations', 'Quotations', 'Inventory', 'Sales Invoice', 'Contracts', 'Government Documents']

    try {
      // Get all existing folders once
      const existingFolders = await CompanyService.getCompanyFolders(companyId, '')
      const existingFolderNames = existingFolders.map(folder => folder.name)

      // Filter out folders that already exist
      const foldersToCreate = defaultFolders.filter(folderName => !existingFolderNames.includes(folderName))

      // Create missing folders
      for (const folderName of foldersToCreate) {
        console.log(`Creating default folder: ${folderName}`)
        await CompanyService.createFolder(companyId, userId, folderName, '')
      }
    } catch (error) {
      console.error('Error creating default folders:', error)
    }
  }, [companyId, userId])

  const loadReservations = useCallback(async (folderType: string, page: number = 1) => {
    setIsLoading(true)
    try {
      // Query bookings collection for this company
      const bookingsRef = collection(db, "booking")
      let q = query(
        bookingsRef,
        where("company_id", "==", companyId),
        orderBy("created", "desc")
      )

      // For pagination, we need to get all first, then paginate
      // In a production app, you'd modify the Firebase query to use limit and startAfter
      const querySnapshot = await getDocs(q)
      const allReservations: any[] = []

      querySnapshot.forEach((doc) => {
        const booking = { id: doc.id, ...doc.data() } as any

        // Only include bookings that have project compliance documents
        if (booking.projectCompliance) {
          const complianceItems = [
            { key: 'finalArtwork', name: 'Final Artwork' },
            { key: 'paymentAsDeposit', name: 'Payment as Deposit' },
            { key: 'poMo', name: 'PO/MO Document' },
            { key: 'signedContract', name: 'Signed Contract' },
            { key: 'signedQuotation', name: 'Signed Quotation' }
          ]

          // Count how many compliance documents this booking has
          let documentCount = 0
          complianceItems.forEach((item) => {
            const complianceItem = booking.projectCompliance[item.key]
            if (complianceItem && complianceItem.fileUrl && complianceItem.fileName) {
              documentCount++
            }
          })

          if (documentCount > 0) {
            const reservationId = booking.reservation_id || booking.id
            allReservations.push({
              id: reservationId,
              reservationId: reservationId,
              bookingId: booking.id,
              documentCount: documentCount,
              created: booking.created,
              bookingData: booking,
              type: 'booking'
            })
          }
        }
      })

      setTotalItems(allReservations.length)

      // Apply pagination
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedReservations = allReservations.slice(startIndex, endIndex)

      setReservations(paginatedReservations)
      setCurrentPage(page)
      setHasNextPage(endIndex < allReservations.length)
      setIsSpecialFolder(true)
      setSpecialFolderType(folderType)
      setSelectedReservationId(null)
      setProjectDocuments([])
    } catch (error) {
      console.error("Error loading reservations:", error)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, pageSize])

  const loadQuotations = useCallback(async (folderType: string, page: number = 1) => {
    setIsLoading(true)
    try {
      // Query quotations collection for this company
      const quotationsRef = collection(db, "quotations")
      const q = query(
        quotationsRef,
        where("company_id", "==", companyId),
        orderBy("created", "desc")
      )

      const querySnapshot = await getDocs(q)
      const allQuotations: any[] = []

      querySnapshot.forEach((doc) => {
        const quotation = { id: doc.id, ...doc.data() } as any

        // Only include quotations that have project compliance documents
        if (quotation.projectCompliance) {
          const complianceItems = [
            { key: 'finalArtwork', name: 'Final Artwork' },
            { key: 'paymentAsDeposit', name: 'Payment as Deposit' },
            { key: 'poMo', name: 'PO/MO Document' },
            { key: 'signedContract', name: 'Signed Contract' },
            { key: 'signedQuotation', name: 'Signed Quotation' }
          ]

          // Count how many compliance documents this quotation has
          let documentCount = 0
          complianceItems.forEach((item) => {
            const complianceItem = quotation.projectCompliance[item.key]
            if (complianceItem && complianceItem.fileUrl && complianceItem.fileName) {
              documentCount++
            }
          })

          if (documentCount > 0) {
            const quotationId = quotation.quotation_number || quotation.id
            allQuotations.push({
              id: quotationId,
              quotationId: quotationId,
              quotationDocId: quotation.id,
              documentCount: documentCount,
              created: quotation.created,
              quotationData: quotation,
              type: 'quotation'
            })
          }
        }
      })

      setTotalItems(allQuotations.length)

      // Apply pagination
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedQuotations = allQuotations.slice(startIndex, endIndex)

      setReservations(paginatedQuotations)
      setCurrentPage(page)
      setHasNextPage(endIndex < allQuotations.length)
      setIsSpecialFolder(true)
      setSpecialFolderType(folderType)
      setSelectedReservationId(null)
      setProjectDocuments([])
    } catch (error) {
      console.error("Error loading quotations:", error)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, pageSize])

  const loadDocumentsForReservation = useCallback(async (reservationId: string) => {
    setIsLoading(true)
    try {
      // Find the reservation/quotation for this ID
      const reservation = reservations.find(r => r.reservationId === reservationId || r.quotationId === reservationId)
      if (!reservation) return

      const sourceData = reservation.type === 'booking' ? reservation.bookingData : reservation.quotationData

      const documents: any[] = []
      const complianceItems = [
        { key: 'finalArtwork', name: 'Final Artwork' },
        { key: 'paymentAsDeposit', name: 'Payment as Deposit' },
        { key: 'poMo', name: 'PO/MO Document' },
        { key: 'signedContract', name: 'Signed Contract' },
        { key: 'signedQuotation', name: 'Signed Quotation' }
      ]

      complianceItems.forEach((item) => {
        const complianceItem = sourceData.projectCompliance[item.key]
        if (complianceItem && complianceItem.fileUrl && complianceItem.fileName) {
          documents.push({
            id: `${sourceData.id}-${item.key}`,
            name: complianceItem.fileName,
            type: 'application/pdf',
            size: 0,
            uploadedAt: complianceItem.uploadedAt?.toDate ? complianceItem.uploadedAt.toDate() : new Date(),
            url: complianceItem.fileUrl,
            sourceId: sourceData.id,
            documentType: item.name,
            reservationId: reservationId,
            sourceType: reservation.type
          })
        }
      })

      setProjectDocuments(documents)
      setSelectedReservationId(reservationId)
    } catch (error) {
      console.error("Error loading documents for reservation:", error)
    } finally {
      setIsLoading(false)
    }
  }, [reservations])

  const loadFiles = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    try {
      // Create default folders if they don't exist
      await createDefaultFolders()

      // For pagination, we'll need to modify CompanyService.getCompanyFiles
      // For now, load all and slice for pagination
      const result = await CompanyService.getCompanyFiles(companyId, currentFolder)
      if (result.success) {
        const allFiles = result.files
        // Deduplicate folders by name, keeping the first occurrence (most recent)
        const folderMap = new Map<string, CompanyFolder>()
        result.folders.forEach(folder => {
          if (!folderMap.has(folder.name)) {
            folderMap.set(folder.name, folder)
          }
        })
        const allFolders = Array.from(folderMap.values())
        const allItems = [...allFolders, ...allFiles]

        setTotalItems(allItems.length)

        // Calculate pagination
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const paginatedItems = allItems.slice(startIndex, endIndex)

        // Separate back into folders and files
        const paginatedFolders = paginatedItems.filter((item): item is CompanyFolder => 'path' in item)
        const paginatedFiles = paginatedItems.filter((item): item is CompanyFile => !('path' in item))

        setFiles(paginatedFiles)
        setFolders(paginatedFolders)
        setCurrentPage(page)
        setHasNextPage(endIndex < allItems.length)
      }
    } catch (error) {
      console.error("Error loading files:", error)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, currentFolder, createDefaultFolders, pageSize])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleFileUpload = async (selectedFiles: File[]) => {
    setUploadingFiles(selectedFiles)
    for (const file of selectedFiles) {
      try {
        const result = await CompanyService.uploadFile(file, companyId, userId, currentFolder)
        if (result.success) {
          await loadFiles()
        }
      } catch (error) {
        console.error("Error uploading file:", error)
      }
    }
    setUploadingFiles([])
    setShowUpload(false)
  }

  const handleFileDownload = async (file: CompanyFile) => {
    try {
      const link = document.createElement("a")
      link.href = file.url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading file:", error)
    }
  }

  const handleFileDelete = async (file: CompanyFile) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return

    try {
      const success = await CompanyService.deleteFile(file.id, companyId, userId)
      if (success) {
        await loadFiles()
      }
    } catch (error) {
      console.error("Error deleting file:", error)
    }
  }

  const handleCreateFolder = async () => {
    const folderName = prompt("Enter folder name:")
    if (!folderName) return

    console.log("Creating folder:", folderName, "in folder:", currentFolder)

    try {
      const result = await CompanyService.createFolder(companyId, userId, folderName, currentFolder)
      console.log("Folder creation result:", result)
      await loadFiles()
    } catch (error) {
      console.error("Error creating folder:", error)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return Image
    if (fileType.startsWith("video/")) return Video
    if (fileType.includes("pdf") || fileType.includes("document")) return FileText
    if (fileType.includes("zip") || fileType.includes("rar")) return Archive
    return File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getBreadcrumbs = () => {
    if (!currentFolder) return []
    return currentFolder.split("/").filter(Boolean)
  }

  const navigateToFolder = (folderPath: string, folderName?: string) => {
    console.log("Navigating to folder:", folderPath)

    // Handle special default folders
    if (folderName === 'Reservations') {
      loadReservations(folderName, 1)
      return
    } else if (folderName === 'Quotations') {
      loadQuotations(folderName, 1)
      return
    }

    // Handle reservation folders within special folders
    if (isSpecialFolder && !selectedReservationId) {
      loadDocumentsForReservation(folderPath)
      return
    }

    // Reset special folder state when navigating to regular folders
    setIsSpecialFolder(false)
    setSpecialFolderType(null)
    setReservations([])
    setProjectDocuments([])
    setSelectedReservationId(null)
    setCurrentPage(1)
    setTotalItems(0)
    setHasNextPage(false)
    setCurrentFolder(folderPath)
  }

  const goBack = () => {
    if (selectedReservationId) {
      // Go back from reservation documents to reservation list
      setSelectedReservationId(null)
      setProjectDocuments([])
    } else if (isSpecialFolder) {
      // Exit special folder view
      setIsSpecialFolder(false)
      setSpecialFolderType(null)
      setReservations([])
      setProjectDocuments([])
      setCurrentFolder("")
      setCurrentPage(1)
      setTotalItems(0)
    } else {
      const pathParts = currentFolder.split("/").filter(Boolean)
      pathParts.pop()
      setCurrentFolder(pathParts.join("/"))
    }
  }

  const handlePageChange = (newPage: number) => {
    if (isSpecialFolder && !selectedReservationId) {
      // Paginate reservations/quotations
      if (specialFolderType === 'Reservations') {
        loadReservations(specialFolderType, newPage)
      } else if (specialFolderType === 'Quotations') {
        loadQuotations(specialFolderType, newPage)
      }
    } else if (!isSpecialFolder) {
      // Paginate regular files/folders
      loadFiles(newPage)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Action Buttons */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Button onClick={handleCreateFolder} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button onClick={() => setShowUpload(true)} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setViewMode('grid')}
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setViewMode('list')}
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Breadcrumbs */}
          {(currentFolder || isSpecialFolder) && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSpecialFolder(false)
                  setSpecialFolderType(null)
                  setReservations([])
                  setProjectDocuments([])
                  setSelectedReservationId(null)
                  setCurrentFolder("")
                }}
                className="h-6 px-2"
              >
                Root
              </Button>
              {isSpecialFolder ? (
                <div className="flex items-center space-x-2">
                  <span>/</span>
                  <span className="text-blue-600 font-medium">{specialFolderType}</span>
                  {selectedReservationId && (
                    <>
                      <span>/</span>
                      <span className="text-blue-600 font-medium">{selectedReservationId}</span>
                    </>
                  )}
                </div>
              ) : (
                getBreadcrumbs().map((part, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span>/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const path = getBreadcrumbs().slice(0, index + 1).join("/")
                        navigateToFolder(path)
                      }}
                      className="h-6 px-2"
                    >
                      {part}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search files and folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Spacer */}
          <div className="h-4"></div>

          {/* Upload Area */}
          {showUpload && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Upload Files</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
              <FileUpload onFileSelect={handleFileUpload} />
            </div>
          )}

          {/* File Grid */}
          {!showUpload && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {/* Skeleton Loading Cards */}
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex flex-col items-center p-4 border rounded-lg animate-pulse"
                    >
                      {/* Icon skeleton */}
                      <div className="h-12 w-12 bg-gray-200 rounded mb-2"></div>

                      {/* Name skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>

                      {/* Date skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>

                      {/* Size skeleton (for files) */}
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>

                  {/* Grid/List Layout */}
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {isSpecialFolder ? (
                       selectedReservationId ? (
                         /* Show documents for selected reservation */
                         projectDocuments.map((doc: any) => {
                           const FileIcon = getFileIcon(doc.type)
                           return (
                             <div
                               key={doc.id}
                               className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group relative bg-blue-50/20 border-blue-200"
                               onClick={() => handleFileDownload(doc)}
                             >
                               <FileIcon className="h-12 w-12 text-blue-600 mb-3" />
                               <p className="text-sm font-medium text-blue-900 text-center truncate w-full mb-1">
                                 {doc.name}
                               </p>
                               <p className="text-xs text-blue-700 text-center mb-1">
                                 {doc.documentType}
                               </p>
                               <p className="text-xs text-blue-600 text-center">
                                 {doc.uploadedAt.toLocaleDateString()}
                               </p>
                             </div>
                           )
                         })
                       ) : (
                         /* Show reservation folders */
                         reservations.map((reservation) => {
                           const displayId = reservation.type === 'booking' ? reservation.reservationId : reservation.quotationId
                           return (
                             <div
                               key={displayId}
                               className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group relative bg-blue-50/30 border-blue-200"
                               onClick={() => navigateToFolder(displayId, displayId)}
                             >
                               <Folder className="h-12 w-12 text-blue-600 mb-3" />
                               <p className="text-sm font-medium text-blue-900 text-center truncate w-full mb-1">
                                 {displayId}
                               </p>
                               <p className="text-xs text-blue-700 text-center">
                                 {reservation.documentCount} document{reservation.documentCount !== 1 ? 's' : ''}
                               </p>
                             </div>
                           )
                         })
                       )
                     ) : (
                      <>
                        {/* Folders */}
                        {filteredFolders.map((folder) => {
                          const isDefaultFolder = ['Reservations', 'Quotations', 'Inventory', 'Sales Invoice', 'Contracts', 'Government Documents'].includes(folder.name)
                          return (
                            <div
                              key={folder.id}
                              className={`flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group relative ${
                                isDefaultFolder ? 'border-blue-200 bg-blue-50/30' : ''
                              }`}
                              onClick={() => navigateToFolder(folder.path, folder.name)}
                            >
                              <Folder className={`h-12 w-12 mb-3 ${
                                isDefaultFolder ? 'text-blue-600' : 'text-blue-500'
                              }`} />
                              <p className={`text-sm font-medium text-center truncate w-full mb-1 ${
                                isDefaultFolder ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {folder.name}
                              </p>
                              <p className="text-xs text-gray-500 mb-1">
                                {isDefaultFolder ? 'Default Folder' : folder.createdAt.toLocaleDateString()}
                              </p>
                              {/* Delete button - only show for non-default folders */}
                              {!isDefaultFolder && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (confirm(`Are you sure you want to delete the folder "${folder.name}"?`)) {
                                        CompanyService.deleteFolder(folder.id, companyId, userId).then(() => {
                                          loadFiles()
                                        })
                                      }
                                    }}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Files */}
                        {filteredFiles.map((file) => {
                          const FileIcon = getFileIcon(file.type)
                          return (
                            <div
                              key={file.id}
                              className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group relative"
                              onClick={() => handleFileDownload(file)}
                            >
                              <FileIcon className="h-12 w-12 text-gray-500 mb-3" />
                              <p className="text-sm font-medium text-gray-900 text-center truncate w-full mb-1">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500 mb-1">
                                {formatFileSize(file.size)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {file.uploadedAt.toLocaleDateString()}
                              </p>
                              {/* Delete button - appears on hover */}
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                                      CompanyService.deleteFile(file.id, companyId, userId).then(() => {
                                        loadFiles()
                                      })
                                    }
                                  }}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                    </div>
                  ) : (
                    /* List View */
                    <div className="space-y-1">
                      {isSpecialFolder ? (
                        selectedReservationId ? (
                          /* List view for documents */
                          projectDocuments.map((doc: any) => {
                            const FileIcon = getFileIcon(doc.type)
                            return (
                              <div
                                key={doc.id}
                                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                                onClick={() => handleFileDownload(doc)}
                              >
                                <FileIcon className="h-8 w-8 text-blue-600 mr-3 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {doc.name}
                                  </p>
                                  <p className="text-xs text-blue-600">
                                    {doc.documentType}
                                  </p>
                                </div>
                                <div className="text-xs text-gray-500 text-right mr-3">
                                  {doc.uploadedAt.toLocaleDateString()}
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          /* List view for reservations */
                          reservations.map((reservation) => {
                            const displayId = reservation.type === 'booking' ? reservation.reservationId : reservation.quotationId
                            return (
                              <div
                                key={displayId}
                                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                                onClick={() => navigateToFolder(displayId, displayId)}
                              >
                                <Folder className="h-8 w-8 text-blue-600 mr-3 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {displayId}
                                  </p>
                                  <p className="text-xs text-blue-700">
                                    {reservation.documentCount} compliance document{reservation.documentCount !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                <div className="text-xs text-gray-500 text-right mr-3">
                                  Reservation Folder
                                </div>
                              </div>
                            )
                          })
                        )
                      ) : (
                        <>
                          {/* List view for folders */}
                          {filteredFolders.map((folder) => {
                            const isDefaultFolder = ['Reservations', 'Quotations', 'Inventory', 'Sales Invoice', 'Contracts', 'Government Documents'].includes(folder.name)
                            return (
                              <div
                                key={folder.id}
                                className={`flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group relative ${
                                  isDefaultFolder ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                                }`}
                                onClick={() => navigateToFolder(folder.path, folder.name)}
                              >
                                <Folder className={`h-8 w-8 mr-3 flex-shrink-0 ${
                                  isDefaultFolder ? 'text-blue-600' : 'text-blue-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${
                                    isDefaultFolder ? 'text-blue-900' : 'text-gray-900'
                                  }`}>
                                    {folder.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {isDefaultFolder ? 'Default Folder' : 'Folder'}
                                  </p>
                                </div>
                                <div className="text-xs text-gray-500 text-right mr-3">
                                  {isDefaultFolder ? '' : folder.createdAt.toLocaleDateString()}
                                </div>
                                {/* Delete button - only show for non-default folders */}
                                {!isDefaultFolder && (
                                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirm(`Are you sure you want to delete the folder "${folder.name}"?`)) {
                                          CompanyService.deleteFolder(folder.id, companyId, userId).then(() => {
                                            loadFiles()
                                          })
                                        }
                                      }}
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {/* List view for files */}
                          {filteredFiles.map((file) => {
                            const FileIcon = getFileIcon(file.type)
                            return (
                              <div
                                key={file.id}
                                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group relative"
                                onClick={() => handleFileDownload(file)}
                              >
                                <FileIcon className="h-8 w-8 text-gray-500 mr-3 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>
                                <div className="text-xs text-gray-500 text-right mr-3">
                                  {file.uploadedAt.toLocaleDateString()}
                                </div>
                                {/* Delete button - appears on hover */}
                                <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                                        CompanyService.deleteFile(file.id, companyId, userId).then(() => {
                                          loadFiles()
                                        })
                                      }
                                    }}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {isSpecialFolder ? (
                    selectedReservationId ? (
                      projectDocuments.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <FileText className="mx-auto h-16 w-16 text-blue-300 mb-4" />
                          <p className="text-lg font-medium">No project compliance documents found</p>
                          <p className="text-sm">Project compliance documents will appear here</p>
                        </div>
                      )
                    ) : (
                      reservations.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Folder className="mx-auto h-16 w-16 text-blue-300 mb-4" />
                          <p className="text-lg font-medium">No reservations with compliance documents found</p>
                          <p className="text-sm">Reservations with project compliance documents will appear here</p>
                        </div>
                      )
                    )
                  ) : (
                    filteredFiles.length === 0 && filteredFolders.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Folder className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                        <p className="text-lg font-medium">No files or folders found</p>
                        <p className="text-sm">Upload files or create folders to get started</p>
                      </div>
                    )
                  )}
                </>
              )}

              {/* Pagination */}
              {totalItems > pageSize && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{' '}
                    {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!hasNextPage}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}
