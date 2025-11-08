"use client"

interface PDFViewerProps {
  fileUrl: string
  className?: string
}

export function PDFViewer({ fileUrl, className = "" }: PDFViewerProps) {
  if (!fileUrl) return null

  return (
    <div className={`w-full h-full ${className}`}>
      <iframe
        src={fileUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
      />
    </div>
  )
}