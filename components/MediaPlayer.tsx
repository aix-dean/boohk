import React, { useState, useEffect, useRef } from "react"

interface MediaPlayerProps {
  url?: string
  className?: string
  controls?: boolean
  playing?: boolean
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ url, className = "w-full h-full object-fill rounded-[10px]", controls = true, playing = false }) => {
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [fallbackContent, setFallbackContent] = useState<React.JSX.Element | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.play().catch(() => {
          // Ignore play errors (e.g., user interaction required)
        })
      } else {
        videoRef.current.pause()
      }
    }
  }, [playing])

  // Reload video when URL changes
  useEffect(() => {
    if (videoRef.current && url && mimeType?.startsWith('video/')) {
      videoRef.current.load()
    }
  }, [url])

  // URL validation function
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Function to detect YouTube URLs
  const isYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    return youtubeRegex.test(url)
  }

  // Function to detect Vimeo URLs
  const isVimeoUrl = (url: string): boolean => {
    const vimeoRegex = /(?:vimeo\.com\/)(?:.*#|.*\/videos\/|.*\/|channels\/.*\/|groups\/.*\/videos\/|album\/.*\/video\/|video\/)?([0-9]+)(?:$|\/|\?)/
    return vimeoRegex.test(url)
  }

  // Function to get YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
    return match ? match[1] : null
  }

  // Function to get Vimeo video ID
  const getVimeoVideoId = (url: string): string | null => {
    const match = url.match(/(?:vimeo\.com\/)(?:.*#|.*\/videos\/|.*\/|channels\/.*\/|groups\/.*\/videos\/|album\/.*\/video\/|video\/)?([0-9]+)(?:$|\/|\?)/)
    return match ? match[1] : null
  }

  // Function to infer MIME type from URL
  const getMimeType = (url: string): string | undefined => {
    // Check for YouTube/Vimeo first
    if (isYouTubeUrl(url) || isVimeoUrl(url)) {
      return 'embed'
    }

    // Remove query parameters and extract extension
    const urlWithoutQuery = url.split('?')[0]
    const extension = urlWithoutQuery.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'mp4':
        return 'video/mp4'
      case 'webm':
        return 'video/webm'
      case 'ogg':
        return 'video/ogg'
      case 'avi':
        return 'video/avi'
      case 'mov':
        return 'video/quicktime'
      case 'm4v':
        return 'video/mp4'
      case 'mkv':
        return 'video/x-matroska'
      case 'flv':
        return 'video/x-flv'
      case 'wmv':
        return 'video/x-ms-wmv'
      case '3gp':
        return 'video/3gpp'
      case 'mpg':
      case 'mpeg':
        return 'video/mpeg'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      case 'gif':
        return 'image/gif'
      case 'webp':
        return 'image/webp'
      case 'svg':
        return 'image/svg+xml'
      case 'bmp':
        return 'image/bmp'
      case 'tiff':
      case 'tif':
        return 'image/tiff'
      default:
        // Try to detect video URLs without extensions (streaming URLs)
        if (url.includes('video') || url.includes('stream') || url.includes('media')) {
          return 'video/mp4' // Default to mp4 for unknown video URLs
        }
        return undefined
    }
  }

  if (!url) {
    return <p className="text-gray-500 text-center">No media URL available</p>
  }

  if (!isValidUrl(url)) {
    return <p className="text-red-500 text-center">Invalid media URL</p>
  }

  if (mediaError) {
    return (
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">{mediaError}</p>
        {fallbackContent}
      </div>
    )
  }

  const mimeType = getMimeType(url)

  if (mimeType === 'embed') {
    if (isYouTubeUrl(url)) {
      const videoId = getYouTubeVideoId(url)
      if (videoId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className={className}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setMediaError(null)
              setFallbackContent(null)
            }}
            onError={() => {
              setMediaError('Failed to load YouTube video')
              setFallbackContent(<p className="text-xs text-gray-500 mt-1">Check the YouTube URL</p>)
            }}
          />
        )
      }
    } else if (isVimeoUrl(url)) {
      const videoId = getVimeoVideoId(url)
      if (videoId) {
        return (
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            className={className}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setMediaError(null)
              setFallbackContent(null)
            }}
            onError={() => {
              setMediaError('Failed to load Vimeo video')
              setFallbackContent(<p className="text-xs text-gray-500 mt-1">Check the Vimeo URL</p>)
            }}
          />
        )
      }
    }
    // Fallback for unrecognized embed URLs
    return (
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Unsupported embed URL</p>
        <p className="text-xs text-gray-500 mt-1">Only YouTube and Vimeo embeds are supported</p>
      </div>
    )
  } else if (mimeType?.startsWith('video/')) {
    return (
      <video
        ref={videoRef}
        controls={controls}
        preload="metadata"
        className={className}
        muted // Add muted to allow autoplay on hover
        onError={(e) => {
          const target = e.target as HTMLVideoElement
          let errorMessage = 'Video failed to load'
          let fallback = null

          if (target.error) {
            switch (target.error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Video loading was aborted'
                break
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error while loading video'
                fallback = <p className="text-xs text-gray-500 mt-1">Check your internet connection</p>
                break
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Video format not supported by your browser'
                fallback = <p className="text-xs text-gray-500 mt-1">Try a different browser or format</p>
                break
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Video source not supported'
                fallback = <p className="text-xs text-gray-500 mt-1">Unsupported video format</p>
                break
              default:
                errorMessage = 'Unknown video error'
                break
            }
          }

          setMediaError(errorMessage)
          setFallbackContent(fallback)
        }}
        onLoadedData={() => {
          setMediaError(null)
          setFallbackContent(null)
        }}
      >
        <source src={url} type={mimeType} />
        Your browser does not support the video tag.
      </video>
    )
  } else if (mimeType?.startsWith('image/')) {
    return (
      <img
        src={url}
        alt="Media content"
        className={className}
        onError={() => {
          setMediaError('Image failed to load')
          setFallbackContent(<p className="text-xs text-gray-500 mt-1">Check the image URL or format</p>)
        }}
        onLoad={() => {
          setMediaError(null)
          setFallbackContent(null)
        }}
      />
    )
  } else {
    return (
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Unsupported media type</p>
        <p className="text-xs text-gray-500 mt-1">Supported: videos, images, YouTube, Vimeo</p>
      </div>
    )
  }
}

export { MediaPlayer }