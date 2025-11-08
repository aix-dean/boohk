import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Title and Badges Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left - Image Skeleton */}
        <div className="col-span-12 md:col-span-2">
          <div className="bg-gray-100 rounded-lg p-4">
            <Skeleton className="w-full aspect-square rounded" />
          </div>
        </div>

        {/* Middle - Description and CMS Config Skeleton */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-16 w-full" />
          </div>

          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full col-span-1 md:col-span-2" />
            </div>
          </div>

          <div>
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Right - ID and Dimensions Skeleton */}
        <div className="col-span-12 md:col-span-4 space-y-4">
          <div>
            <Skeleton className="h-4 w-8 mb-1" />
            <Skeleton className="h-4 w-48" />
          </div>

          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-4">
        <div className="grid w-full grid-cols-4 bg-gray-100 rounded-lg p-1">
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-10 rounded" />
        </div>

        {/* Tab Content Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Table Header Skeleton */}
              <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
              </div>

              {/* Table Rows Skeleton */}
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="grid grid-cols-7 gap-4 py-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
