export default function ReportPreviewLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button and Content Title Section */}
      <div className="bg-white px-6 py-4 flex items-center gap-4 shadow-sm">
        <div className="rounded-full p-3 bg-gray-200 animate-pulse">
          <div className="h-6 w-6 bg-gray-300 rounded"></div>
        </div>
        <div className="bg-gray-200 animate-pulse px-4 py-2 rounded-full">
          <div className="h-6 w-20 bg-gray-300 rounded"></div>
        </div>
      </div>

      {/* Header Skeleton */}
      <div className="w-full h-32 bg-gray-200 animate-pulse"></div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Report Title Skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="bg-gray-200 animate-pulse px-4 py-2 rounded-full w-48 h-10"></div>
            <div className="bg-gray-200 animate-pulse w-32 h-4 rounded"></div>
          </div>
          <div className="bg-gray-200 animate-pulse h-24 w-24 rounded"></div>
        </div>

        {/* Project Information Skeleton */}
        <div className="bg-white rounded-lg border p-6">
          <div className="bg-gray-200 animate-pulse w-48 h-8 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse w-full h-4 rounded"></div>
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse w-full h-4 rounded"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Project Status Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-gray-200 animate-pulse w-32 h-8 rounded"></div>
            <div className="bg-gray-200 animate-pulse w-16 h-6 rounded"></div>
          </div>

          {/* Attachments Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="bg-gray-200 animate-pulse rounded-lg h-64"></div>
                <div className="space-y-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-gray-200 animate-pulse w-full h-4 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="flex justify-between items-end pt-8 border-t">
          <div className="space-y-2">
            <div className="bg-gray-200 animate-pulse w-24 h-4 rounded"></div>
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse w-20 h-3 rounded"></div>
              ))}
            </div>
          </div>
          <div className="bg-gray-200 animate-pulse w-64 h-4 rounded"></div>
        </div>
      </div>

      {/* Bottom Branding Skeleton */}
      <div className="w-full mt-8 h-16 bg-gray-200 animate-pulse"></div>
    </div>
  )
}
