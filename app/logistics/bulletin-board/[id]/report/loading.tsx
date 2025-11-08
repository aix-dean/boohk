import { Skeleton } from "@/components/ui/skeleton"

export default function ReportLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Header Image Skeleton */}
      <Skeleton className="w-full h-20" />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Report Title Skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
          <Skeleton className="h-24 w-24" />
        </div>

        {/* Project Information Skeleton */}
        <div className="bg-white rounded-lg p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Project Status Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Skeleton className="h-64 w-full rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="flex justify-between items-end pt-8 border-t">
          <div>
            <Skeleton className="h-6 w-24 mb-2" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-80" />
        </div>
      </div>

      {/* Bottom Branding Skeleton */}
      <Skeleton className="w-full h-16 mt-8" />
    </div>
  )
}
