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
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const displayText = media.duration ? formatDuration(media.duration) : null
  const isVideo = media.type.startsWith("video/")

  return (
    <div
      className={cn(
        "overflow-hidden cursor-pointer transition-all h-[280px] flex flex-col",
        className
      )}
      onClick={onClick}
    >
      <div className="h-[200px] bg-gray-300 relative">
        {isVideo ? (
          <video
            src={media.url}
            className="h-full w-full object-contain"
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
            className="object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/abstract-geometric-sculpture.png"
              target.className = "opacity-50 object-contain"
            }}
          />
        )}
      </div>

      <div className="px-4 pb-4" style={{ marginTop: '11px' }}>
        <div className="space-y-1">
          <div className="text-sm text-black font-medium line-clamp-2">
            {media.title || media.name || "Untitled"}
          </div>
          {displayText && (
            <div className="text-xs text-gray-500">
              {displayText}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}