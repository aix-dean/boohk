import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

export default function NewInventoryItemLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-9 w-32" />
            <Separator orientation="vertical" className="h-6" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-6 w-20" />
        </div>

        {/* Stepper Skeleton */}
        <div className="mb-12">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-8 left-8 right-8 h-0.5 bg-slate-200 -z-10">
              <Skeleton className="h-full w-1/4" />
            </div>

            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center relative">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="mt-4 text-center space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-8 mb-8">
          <div className="text-center space-y-4">
            <Skeleton className="w-16 h-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>

          <Card className="border-2 border-dashed">
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-12 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Skeleton */}
        <div className="flex justify-between items-center bg-white rounded-lg p-6 shadow-sm border">
          <Skeleton className="h-10 w-24" />
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
