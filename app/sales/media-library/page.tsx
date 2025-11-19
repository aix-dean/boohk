"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { MediaCard } from "@/components/media-card"
import { MediaUploadDialog } from "@/components/media-upload-dialog"
import { MediaDetailsDialog } from "@/components/media-details-dialog"
import { getPaginatedMediaLibrary } from "@/lib/firebase-service"
import type { Media } from "oh-db-models"
import { RouteProtection } from "@/components/route-protection"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore"

function MediaLibraryContent() {
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  const { userData } = useAuth()
  const { toast } = useToast()

  const loadMedia = useCallback(async (loadMore = false) => {
    if (!userData?.company_id) return

    try {
      if (loadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const result = await getPaginatedMediaLibrary(
        userData.company_id,
        16, // items per page
        loadMore ? lastDoc : null
      )

      if (loadMore) {
        setMediaItems(prev => [...prev, ...result.items])
      } else {
        setMediaItems(result.items)
      }

      setLastDoc(result.lastDoc)
      setHasMore(result.hasMore)
    } catch (error) {
      console.error("Error loading media:", error)
      toast({
        title: "Error",
        description: "Failed to load media library.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [userData?.company_id, lastDoc, toast])

  useEffect(() => {
    loadMedia()
  }, [userData?.company_id])

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadMedia(true)
    }
  }

  const handleUploadSuccess = () => {
    // Reload media items
    loadMedia()
  }

  const handleMediaClick = (media: Media) => {
    setSelectedMedia(media)
    setDetailsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-64 bg-gray-200 rounded mb-2 animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <div className="h-48 bg-gray-200 animate-pulse" />
              <div className="p-4">
                <div className="h-4 w-1/3 bg-gray-200 rounded mb-2 animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-[#333333]">Media Library</h1>
        </div>

        <MediaUploadDialog onSuccess={handleUploadSuccess}>
          <Button className="bg-white text-xs border text-gray-600 py-0 hover:bg-white">
            Upload Media
          </Button>
        </MediaUploadDialog>
      </div>

      {/* Media Grid */}
      {mediaItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No media yet</h3>
          <p className="text-gray-500 mb-4">Upload your first media file to get started</p>
          <MediaUploadDialog onSuccess={handleUploadSuccess}>
            <Button variant="outline" className="hover:bg-transparent">
              <Plus className="mr-2 h-4 w-4" />
              Upload Media
            </Button>
          </MediaUploadDialog>
        </div>
      ) : (
        <>
          <ResponsiveCardGrid
            mobileColumns={1}
            tabletColumns={2}
            desktopColumns={4}
            gap="xl"
          >
            {mediaItems.map((media) => (
              <MediaCard
                key={media.id}
                media={media}
                onClick={() => handleMediaClick(media)}
              />
            ))}
          </ResponsiveCardGrid>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Media Details Dialog */}
      <MediaDetailsDialog
        media={selectedMedia}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  )
}

export default function MediaLibraryPage() {
  return (
    <RouteProtection requiredRoles="sales">
      <div className="min-h-screen bg-[#fafafa] p-6">
        <div className="max-w-7xl mx-auto">
          <MediaLibraryContent />
        </div>
      </div>
    </RouteProtection>
  )
}