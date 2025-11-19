"use client"

import Image from "next/image"
import { Media } from "oh-db-models"
import { cn } from "@/lib/utils"

interface MediaCardProps {
  media: Media
  onClick?: () => void
  className?: string
}

export function MediaCard({ media, onClick, className }: MediaCardProps) {
  const isVideo = media.type.startsWith("video/")

  return (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all hover:shadow-xl h-[280px] flex flex-col",
        className
      )}
      onClick={onClick}
    >
      <div className="h-[200px] bg-gray-300 relative rounded-t-2xl">
        {isVideo ? (
          <video
            src={media.url}
            className="h-full w-full object-cover"
            controls={false}
            muted
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => e.currentTarget.pause()}
          />
        ) : (
          <Image
            src={media.url}
            alt={media.title || media.name || "Media"}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/abstract-geometric-sculpture.png"
              target.className = "opacity-50 object-contain"
            }}
          />
        )}

        {/* Video indicator */}
        {isVideo && (
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
            VIDEO
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-center">
        <div className="space-y-1">
          <div className="text-sm text-black font-medium line-clamp-2">
            {media.title || media.name || "Untitled"}
          </div>
          <div className="text-xs text-gray-500">
            {media.uploadDate ? new Date(media.uploadDate.toDate()).toLocaleDateString() : "No date"}
          </div>
        </div>
      </div>
    </div>
  )
}