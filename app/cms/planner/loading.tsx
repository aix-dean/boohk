import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function CMSPlannerLoading() {
  return (
    <div className="flex-1 p-6">
      <div className="flex flex-col gap-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Controls skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-6 w-40 ml-2" />
              </div>

              <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-9 w-[300px]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar skeleton */}
        <div className="bg-white border rounded-lg p-4">
          <div className="grid grid-cols-7 gap-1 mt-4">
            {/* Day headers */}
            {Array(7)
              .fill(null)
              .map((_, i) => (
                <Skeleton key={`header-${i}`} className="h-8" />
              ))}

            {/* Calendar days */}
            {Array(35)
              .fill(null)
              .map((_, i) => (
                <Skeleton key={`day-${i}`} className="h-[120px]" />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
