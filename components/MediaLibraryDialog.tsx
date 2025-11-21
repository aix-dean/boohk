"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MediaCard } from "@/components/media-card"
import { Media } from "oh-db-models"
import { getPaginatedMediaLibrary, getMediaLibraryCount } from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, Search, X } from "lucide-react"
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore"

interface MediaLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMedia: (media: Media) => void
}

export function MediaLibraryDialog({ open, onOpenChange, onSelectMedia }: MediaLibraryDialogProps) {
  const { userData } = useAuth()
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const companyId = userData?.company_id

  const fetchMedia = useCallback(async (reset = false) => {
    if (!companyId) return

    setLoading(true)
    try {
      const result = await getPaginatedMediaLibrary(
        companyId,
        12, // items per page
        reset ? null : lastDoc,
        { searchTerm: searchTerm || undefined }
      )

      if (reset) {
        setMediaItems(result.items)
      } else {
        setMediaItems(prev => [...prev, ...result.items])
      }

      setLastDoc(result.lastDoc)
      setHasMore(result.hasMore)
    } catch (error) {
      console.error("Error fetching media library:", error)
    } finally {
      setLoading(false)
    }
  }, [companyId, lastDoc, searchTerm])

  const fetchCount = useCallback(async () => {
    if (!companyId) return

    try {
      const count = await getMediaLibraryCount(companyId, searchTerm || undefined)
      setTotalCount(count)
    } catch (error) {
      console.error("Error fetching media count:", error)
    }
  }, [companyId, searchTerm])

  useEffect(() => {
    if (open && companyId) {
      fetchMedia(true)
      fetchCount()
    }
  }, [open, companyId, fetchMedia, fetchCount])

  const handleSearch = () => {
    setLastDoc(null)
    fetchMedia(true)
    fetchCount()
  }

  const handleLoadMore = () => {
    fetchMedia(false)
  }

  const handleSelectMedia = (media: Media) => {
    onSelectMedia(media)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchTerm("")
    setMediaItems([])
    setLastDoc(null)
    setHasMore(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Media Library</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search media..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} variant="outline">
            Search
          </Button>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto">
          {mediaItems.length === 0 && !loading ? (
            <div className="text-center py-8 text-gray-500">
              No media items found
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                {mediaItems.map((media) => (
                  <MediaCard
                    key={media.id || media.url}
                    media={media}
                    onClick={() => handleSelectMedia(media)}
                    className="border-2 border-transparent hover:border-blue-500 transition-colors"
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center mb-4">
                  <Button
                    onClick={handleLoadMore}
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {loading && mediaItems.length === 0 && (
            <div className="text-center py-8">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-2 text-gray-500">Loading media...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            {totalCount > 0 && `Showing ${mediaItems.length} of ${totalCount} items`}
          </div>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}