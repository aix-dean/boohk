import { Skeleton } from "@/components/ui/skeleton"

export default function SalesPlannerLoading() {
  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header with title and actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Calendar controls */}
        <Skeleton className="h-24 w-full rounded-lg" />

        {/* Calendar view */}
        <div className="bg-white border rounded-lg p-2 sm:p-4 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 mt-4">
              {/* Day headers */}
              {Array(7)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={`header-${i}`} className="h-6 w-full" />
                ))}

              {/* Calendar days */}
              {Array(35)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={`day-${i}`} className="h-24 w-full" />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
